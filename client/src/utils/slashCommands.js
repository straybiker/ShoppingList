export const processSlashCommand = async (text, navigate, context = {}) => {
    if (!text || !text.startsWith('/')) return false;

    const { clearCache, showToast } = context;
    const cmd = text.trim();

    if (cmd === '/clear-cache') {
        if (clearCache) await clearCache();
        return true;
    }

    // Admin view: the server asks for the admin token
    if (cmd === '/config-lists') {
        navigate('/config-lists');
        return true;
    }

    if (showToast) showToast('Unknown command', 'error');
    return true; // We handled it (even if unknown, it was a slash command intention)
};
