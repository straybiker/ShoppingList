import { removeMyList, restoreMyList } from './device';

export async function shareList(listId, name, showToast) {
    const shareUrl = `${window.location.origin}/?list=${encodeURIComponent(listId)}`;
    if (navigator.share) {
        try {
            await navigator.share({ title: name || 'Shopping List', url: shareUrl });
        } catch (err) {
            if (err.name !== 'AbortError') console.error(err);
        }
        return;
    }
    try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Link copied to clipboard', 'success');
    } catch {
        showToast('Failed to copy', 'error');
    }
}

// Remove a list from this device only. Other people keep the list.
export function removeListFromDevice(listId, showToast) {
    const removed = removeMyList(listId);
    if (!removed) return;
    showToast('Removed from your lists', 'info', {
        actionLabel: 'Undo',
        onAction: () => restoreMyList(removed)
    });
}

// Delete a list for everyone who has the link. The server keeps it
// restorable for 30 days; the toast offers an immediate undo.
export async function deleteListForEveryone(listId, name, showToast) {
    const label = name ? `"${name}"` : 'this list';
    if (!window.confirm(`Delete ${label} for everyone who has the link?`)) return false;

    try {
        const res = await fetch(`/api/lists/${encodeURIComponent(listId)}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 410) throw new Error(res.statusText);
    } catch {
        showToast('Error deleting list', 'error');
        return false;
    }

    const removed = removeMyList(listId);
    showToast('List deleted', 'info', {
        actionLabel: 'Undo',
        onAction: async () => {
            try {
                const res = await fetch(`/api/lists/${encodeURIComponent(listId)}/restore`, { method: 'POST' });
                if (!res.ok) throw new Error(res.statusText);
                restoreMyList(removed);
                showToast('List restored', 'success');
            } catch {
                showToast('Failed to restore list', 'error');
            }
        }
    });
    return true;
}
