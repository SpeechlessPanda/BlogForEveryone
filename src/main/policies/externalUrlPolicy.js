const EXTERNAL_URL_RULES = {
    windowOpen: {
        allowedProtocols: ['https:'],
        allowedHosts: ['github.com', 'github.io'],
        allowedHostSuffixes: ['.github.io']
    },
    preview: {
        allowedProtocols: ['http:'],
        allowedHosts: ['localhost', '127.0.0.1']
    },
    installer: {
        allowedProtocols: ['https:'],
        allowedHosts: ['git-scm.com', 'nodejs.org']
    },
    githubDeviceVerification: {
        allowedProtocols: ['https:'],
        allowedHosts: ['github.com'],
        allowedPathPrefixes: ['/login/device']
    },
    rssArticle: {
        allowedProtocols: ['http:', 'https:']
    }
};

function toLowerSet(items) {
    return new Set((items || []).map((item) => String(item || '').toLowerCase()).filter(Boolean));
}

function evaluateExternalUrl(rawUrl, rule = {}) {
    const raw = String(rawUrl || '').trim();
    if (!raw) {
        return { allowed: false, reason: 'INVALID_URL' };
    }

    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        return { allowed: false, reason: 'INVALID_URL' };
    }

    const protocol = String(parsed.protocol || '').toLowerCase();
    const allowedProtocols = toLowerSet(rule.allowedProtocols);
    if (allowedProtocols.size > 0 && !allowedProtocols.has(protocol)) {
        return { allowed: false, reason: 'SCHEME_NOT_ALLOWED' };
    }

    if (parsed.username || parsed.password) {
        return { allowed: false, reason: 'CREDENTIALS_NOT_ALLOWED' };
    }

    const hostname = String(parsed.hostname || '').toLowerCase();
    const allowedHosts = toLowerSet(rule.allowedHosts);
    const hostSuffixes = (rule.allowedHostSuffixes || []).map((item) => String(item || '').toLowerCase()).filter(Boolean);

    if (allowedHosts.size > 0 || hostSuffixes.length > 0) {
        const exactAllowed = allowedHosts.has(hostname);
        const suffixAllowed = hostSuffixes.some((suffix) => hostname.endsWith(suffix) && hostname.length > suffix.length);
        if (!exactAllowed && !suffixAllowed) {
            return { allowed: false, reason: 'HOST_NOT_ALLOWED' };
        }
    }

    const allowedPathPrefixes = rule.allowedPathPrefixes || [];
    if (allowedPathPrefixes.length > 0) {
        const pathAllowed = allowedPathPrefixes.some((prefix) => parsed.pathname.startsWith(prefix));
        if (!pathAllowed) {
            return { allowed: false, reason: 'PATH_NOT_ALLOWED' };
        }
    }

    return {
        allowed: true,
        normalizedUrl: parsed.toString()
    };
}

module.exports = {
    evaluateExternalUrl,
    EXTERNAL_URL_RULES
};
