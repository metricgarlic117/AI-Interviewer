/**
 * Consistent success envelope: every 2xx response body is
 * { success: true, message, data }.
 */
export default class ApiResponse {
  constructor(statusCode, data = null, message = 'OK') {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }

  /** Sends this envelope on an Express response. */
  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
    });
  }
}
