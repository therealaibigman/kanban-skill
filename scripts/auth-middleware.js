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
        this.loadToken();
    }

    loadToken() {
        try {
            const config = fs.readJsonSync(this.configPath);
            this.validToken = config?.gateway?.auth?.token;
            
            if (!this.validToken) {
                console.warn('[Auth] No gateway token found in config, auth will fail');
            } else {
                console.log('[Auth] Loaded gateway token from config');
            }
        } catch (error) {
            console.error('[Auth] Failed to load config:', error.message);
        }
    }

    // Middleware function
    authenticate(req, res, next) {
        // Health check is always allowed (for monitoring)
        if (req.path === '/health') {
            return next();
        }

        // Check for token in various places
        const authHeader = req.headers['authorization'];
        const queryToken = req.query.token;
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
        
        // Fallback to query param or cookie
        if (!providedToken) {
            providedToken = queryToken || cookieToken;
        }
        
        // Validate token
        if (!providedToken) {
            console.warn(`[Auth] Rejected ${req.method} ${req.path} - No token provided`);
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Provide OpenClaw gateway token via Authorization header, ?token= param, or cookie'
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
