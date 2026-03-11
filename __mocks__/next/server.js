/**
 * Manual mock for next/server
 * Provides lightweight NextRequest and NextResponse implementations
 * that work in a Jest Node environment without the full Next.js runtime.
 */

class NextRequest {
    constructor(url, init) {
        this.url = url;
        this.method = (init && init.method) || 'GET';
        this._body = (init && init.body) || null;
        this.headers = new Map();
        if (init && init.headers) {
            Object.entries(init.headers).forEach(([k, v]) => this.headers.set(k, v));
        }
    }

    async json() {
        if (this._body) {
            return JSON.parse(this._body);
        }
        return null;
    }

    async text() {
        return this._body || '';
    }
}

class NextResponse {
    constructor(body, init) {
        this._body = body;
        this.status = (init && init.status) || 200;
        this.headers = new Map();
        if (init && init.headers) {
            Object.entries(init.headers).forEach(([k, v]) => this.headers.set(k, v));
        }
    }

    async json() {
        if (typeof this._body === 'string') {
            return JSON.parse(this._body);
        }
        return this._body;
    }

    static json(data, init) {
        return new NextResponse(data, init);
    }
}

module.exports = { NextRequest, NextResponse };
