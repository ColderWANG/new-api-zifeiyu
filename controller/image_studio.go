package controller

import (
	"bytes"
	"encoding/base64"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

const imageStudioMaxFileBytes = 10 << 20

type imageStudioRequest struct {
	Model       string `json:"model"`
	Prompt      string `json:"prompt"`
	Protocol    string `json:"protocol"`
	Group       string `json:"group"`
	N           *uint  `json:"n"`
	Size        string `json:"size"`
	AspectRatio string `json:"aspect_ratio"`
}

// PrepareImageStudio adapts a dashboard request to the existing relay pipeline.
// Only the session's own group is used; provider credentials never reach the UI.
func PrepareImageStudio(c *gin.Context) {
	if _, ok := middleware.GetSessionAuthIdentity(c); !ok || c.GetBool("use_access_token") {
		imageStudioError(c, http.StatusForbidden, "A dashboard login session is required.")
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 12<<20)
	var input imageStudioRequest
	var imageBytes []byte
	var imageType string
	if c.ContentType() == "multipart/form-data" {
		form, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			imageStudioError(c, http.StatusBadRequest, "Invalid reference image upload.")
			return
		}
		defer form.RemoveAll()
		fields := map[string]string{}
		for key, values := range form.Value {
			if len(values) != 1 {
				imageStudioError(c, http.StatusBadRequest, "Duplicate image generation fields are not allowed.")
				return
			}
			fields[key] = values[0]
		}
		input = imageStudioRequest{Model: fields["model"], Prompt: fields["prompt"], Protocol: fields["protocol"], Group: fields["group"], Size: fields["size"], AspectRatio: fields["aspect_ratio"]}
		n, err := strconv.ParseUint(fields["n"], 10, 32)
		if err != nil || n < 1 || n > dto.MaxImageN {
			imageStudioError(c, http.StatusBadRequest, "Invalid image count.")
			return
		}
		input.N = common.GetPointer(uint(n))
		if len(form.File) != 1 || len(form.File["image"]) != 1 {
			imageStudioError(c, http.StatusBadRequest, "Choose one reference image.")
			return
		}
		file := form.File["image"][0]
		if file.Size < 1 || file.Size > imageStudioMaxFileBytes {
			imageStudioError(c, http.StatusBadRequest, "Choose a non-empty image smaller than 10 MB.")
			return
		}
		reader, err := file.Open()
		if err != nil {
			imageStudioError(c, http.StatusBadRequest, "Invalid reference image upload.")
			return
		}
		imageBytes, err = io.ReadAll(io.LimitReader(reader, imageStudioMaxFileBytes+1))
		_ = reader.Close()
		if err != nil || len(imageBytes) == 0 || len(imageBytes) > imageStudioMaxFileBytes {
			imageStudioError(c, http.StatusBadRequest, "Invalid reference image upload.")
			return
		}
		imageType = http.DetectContentType(imageBytes)
		if !slices.Contains([]string{"image/png", "image/jpeg", "image/webp"}, imageType) {
			imageStudioError(c, http.StatusBadRequest, "Please choose a PNG, JPG or WebP image.")
			return
		}
	} else if c.ContentType() != "application/json" {
		imageStudioError(c, http.StatusUnsupportedMediaType, "Use JSON or multipart form data.")
		return
	} else if err := common.UnmarshalBodyReusable(c, &input); err != nil {
		imageStudioError(c, http.StatusBadRequest, "Invalid image generation request.")
		return
	}
	input.Prompt = strings.TrimSpace(input.Prompt)
	if input.Prompt == "" || utf8.RuneCountInString(input.Prompt) > 2000 {
		imageStudioError(c, http.StatusBadRequest, "Enter an image description of up to 2000 characters.")
		return
	}
	if input.N == nil || *input.N < 1 || *input.N > dto.MaxImageN {
		imageStudioError(c, http.StatusBadRequest, "Invalid image count.")
		return
	}
	group := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	if group == "" || input.Group != "" && input.Group != group || !strings.Contains(strings.ToLower(input.Model), "image") || !slices.Contains(model.GetGroupEnabledModels(group), input.Model) {
		imageStudioError(c, http.StatusForbidden, "This image model is not available in your current group.")
		return
	}
	var body []byte
	var err error
	contentType := "application/json"
	switch input.Protocol {
	case "images":
		if !slices.Contains([]string{"auto", "1024x1024", "1536x1024", "1024x1536", "1536x864"}, input.Size) {
			imageStudioError(c, http.StatusBadRequest, "Unsupported image size.")
			return
		}
		c.Request.URL.Path = "/v1/images/generations"
		fields := map[string]any{"model": input.Model, "prompt": input.Prompt, "n": *input.N, "size": input.Size}
		if strings.Contains(strings.ToLower(input.Model), "gpt-image") {
			fields["quality"] = "auto"
		}
		if len(imageBytes) == 0 {
			body, err = common.Marshal(fields)
		} else {
			c.Request.URL.Path = "/v1/images/edits"
			var buffer bytes.Buffer
			writer := multipart.NewWriter(&buffer)
			for key, value := range fields {
				text, ok := value.(string)
				if !ok {
					text = strconv.FormatUint(uint64(*input.N), 10)
				}
				if err = writer.WriteField(key, text); err != nil {
					break
				}
			}
			if err == nil {
				var part io.Writer
				// Provider adaptors use the filename's extension for uploaded images.
				ext := map[string]string{"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[imageType]
				header := make(textproto.MIMEHeader)
				header.Set("Content-Disposition", `form-data; name="image"; filename="reference.`+ext+`"`)
				header.Set("Content-Type", imageType)
				part, err = writer.CreatePart(header)
				if err == nil {
					_, err = part.Write(imageBytes)
				}
			}
			if closeErr := writer.Close(); err == nil {
				err = closeErr
			}
			body, contentType = buffer.Bytes(), writer.FormDataContentType()
		}
	case "chat":
		if *input.N != 1 || !slices.Contains([]string{"1:1", "3:2", "2:3", "16:9"}, input.AspectRatio) {
			imageStudioError(c, http.StatusBadRequest, "Chat image generation requires one image and a supported aspect ratio.")
			return
		}
		content := []map[string]any{{"type": "text", "text": input.Prompt}}
		if len(imageBytes) > 0 {
			content = append(content, map[string]any{"type": "image_url", "image_url": map[string]string{"url": "data:" + imageType + ";base64," + base64.StdEncoding.EncodeToString(imageBytes)}})
		}
		body, err = common.Marshal(map[string]any{"model": input.Model, "stream": false, "messages": []map[string]any{{"role": "user", "content": content}}, "extra_body": map[string]any{"google": map[string]any{"image_config": map[string]string{"aspect_ratio": input.AspectRatio}}}})
		c.Request.URL.Path = "/v1/chat/completions"
	default:
		imageStudioError(c, http.StatusBadRequest, "Unsupported image generation protocol.")
		return
	}
	if err != nil {
		imageStudioError(c, http.StatusInternalServerError, "Could not prepare the image generation request.")
		return
	}
	storage, err := common.CreateBodyStorage(body)
	if err != nil {
		imageStudioError(c, http.StatusInternalServerError, "Could not prepare the image generation request.")
		return
	}
	common.CleanupBodyStorage(c)
	c.Set(common.KeyBodyStorage, storage)
	c.Set("_original_multipart_ct", contentType)
	c.Request.Body = io.NopCloser(storage)
	c.Request.ContentLength = int64(len(body))
	c.Request.Header.Set("Content-Type", contentType)
	c.Request.Header.Del("Content-Length")
	c.Request.URL.RawQuery = ""
	c.Request.Form, c.Request.PostForm, c.Request.MultipartForm = nil, nil, nil
	common.SetContextKey(c, constant.ContextKeyUsingGroup, group)
	if err := middleware.SetupContextForToken(c, &model.Token{UserId: c.GetInt("id"), Name: "image-studio", Group: group, UnlimitedQuota: true}); err != nil {
		imageStudioError(c, http.StatusInternalServerError, "Could not prepare the image generation request.")
		return
	}
	var format types.RelayFormat = types.RelayFormatOpenAIImage
	if input.Protocol == "chat" {
		format = types.RelayFormatOpenAI
	}
	// Run the existing multiplier/request validation before plugin selection too.
	if _, err := helper.GetAndValidateRequest(c, format); err != nil {
		imageStudioError(c, http.StatusBadRequest, err.Error())
		return
	}
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	}
	c.Next()
}

func imageStudioError(c *gin.Context, status int, message string) {
	err := types.NewErrorWithStatusCode(errors.New(message), types.ErrorCodeInvalidRequest, status, types.ErrOptionWithSkipRetry())
	c.AbortWithStatusJSON(status, gin.H{"error": err.ToOpenAIError()})
}

func ImageStudio(c *gin.Context) {
	if c.Request.URL.Path == "/v1/chat/completions" {
		Relay(c, types.RelayFormatOpenAI)
		return
	}
	RelayTaskPluginEndpoint(c, func(c *gin.Context) { Relay(c, types.RelayFormatOpenAIImage) })
}
