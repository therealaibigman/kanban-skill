/**
 * Authentication middleware for Kanban server
 * Validates requests against OpenClaw gateway token
 */

const fs = require('fs-extra');
const path = require('path');

class AuthMiddleware {
    constructor() {
        this.configPath = path.join(process.env.HOME, '.openclaw', 'openclaw.json');
        this.validToken = null;
        this.validPassword = null;
        this.loadToken();
    }

    loadToken() {
        try {
            const config = fs.readJsonSync(this.configPath);
            this.validToken = config?.gateway?.auth?.token;
            this.validPassword = config?.gateway?.auth?.password || process.env.KANBAN_PASSWORD;
            
            if (!this.validToken) {
                console.warn('[Auth] No gateway token found in config, auth will fail');
            } else {
                console.log('[Auth] Loaded gateway token from config');
            }
            
            if (!this.validPassword) {
                console.warn('[Auth] No password configured, password login disabled');
            } else {
                console.log('[Auth] Password login enabled');
            }
        } catch (error) {
            console.error('[Auth] Failed to load config:', error.message);
        }
    }

    validatePassword(password) {
        if (!this.validPassword) {
            return { valid: false, error: 'Password authentication not configured' };
        }
        
        if (password === this.validPassword) {
            return { valid: true, token: this.validToken };
        }
        
        return { valid: false, error: 'Invalid password' };
    }

    // Middleware function
    authenticate(req, res, next) {
        // Exempt these paths from auth
        const exemptPaths = [
            '/health',
            '/api/auth/login',
            '/kanban',
            '/kanban/',
        ];
        
        // Exempt all static assets under /kanban/
        if (req.path.startsWith('/kanban/') || exemptPaths.includes(req.path)) {
            return next();
        }

        // Check for token in secure places only (NO URL params)
        const authHeader = req.headers['authorization'];
        const cookieToken = req.cookies?.openclaw_token;
        
        let providedToken = null;
        
        // Extract from Authorization header (Bearer token)
        if (authHeader) {
            const matches = authHeader.match(/^Bearer\s+(.+)$/i);
            if (matches) {
                providedToken = matches[1];
            } else {
                providedToken = authHeader;
            }
        }
        
        // Fallback to cookie only (no query params for security)
        if (!providedToken) {
            providedToken = cookieToken;
        }
        
        // Validate token
        if (!providedToken) {
            console.warn(`[Auth] Rejected ${req.method} ${req.path} - No token provided`);
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Provide OpenClaw gateway token via Authorization header or cookie'
            });
        }
        
        if (providedToken !== this.validToken) {
            console.warn(`[Auth] Rejected ${req.method} ${req.path} - Invalid token`);
            return res.status(403).json({ 
                error: 'Invalid token',
                message: 'Token does not match OpenClaw gateway token'
            });
        }
        
        // Token is valid
        next();
    }

    // Express middleware wrapper
    middleware() {
        return (req, res, next) => this.authenticate(req, res, next);
    }
}

module.exports = AuthMiddleware;
