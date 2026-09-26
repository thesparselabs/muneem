// Package httpx holds the Echo server wiring, cross-cutting middleware and the error envelope.
package httpx

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api"
)

// Fail writes the OpenAPI ErrorResponse envelope. Never leaks stack traces or SQL text.
func Fail(c echo.Context, status int, code string, class api.ErrorResponseErrorClass, msg string) error {
	var body api.ErrorResponse
	body.Error.Code = code
	body.Error.Class = class
	body.Error.Message = msg
	rid := c.Response().Header().Get(echo.HeaderXRequestID)
	if rid != "" {
		body.Error.RequestId = &rid
	}
	return c.JSON(status, body)
}

func Validation(c echo.Context, msg string) error {
	return Fail(c, http.StatusUnprocessableEntity, "VALIDATION_FAILED", api.Validation, msg)
}
func Unauthorized(c echo.Context, code, msg string) error {
	return Fail(c, http.StatusUnauthorized, code, api.Auth, msg)
}
func NotFound(c echo.Context, what string) error {
	return Fail(c, http.StatusNotFound, "NOT_FOUND", api.BusinessRule, what+" not found")
}
func Conflict(c echo.Context, code, msg string) error {
	return Fail(c, http.StatusConflict, code, api.Conflict, msg)
}
func Internal(c echo.Context, err error) error {
	c.Logger().Error(err)
	return Fail(c, http.StatusInternalServerError, "INTERNAL", api.Permanent, "internal error")
}
