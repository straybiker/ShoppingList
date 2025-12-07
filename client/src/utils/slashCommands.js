export const processSlashCommand = async (text, navigate, context = {}) => {
    if (!text || !text.startsWith('/')) return false;

    const { clearCache, saveCurrentListState, showToast } = context;
    const cmd = text.trim();

    if (cmd === '/clear-cache') {
        if (clearCache) await clearCache();
        return true;
    }

    if (cmd === '/config-lists') {
        if (saveCurrentListState) saveCurrentListState();
        navigate('/config-lists');
        return true;
    }

    if (cmd === '/config-users') {
        if (saveCurrentListState) saveCurrentListState();
        navigate('/config-users');
        return true;
    }

    if (showToast) showToast('Unknown command', 'error');
    return true; // We handled it (even if unknown, it was a slash command intention)
};
