/**
 * Phantoms Music — Queue Panel
 * Displays the current playback queue, allows removing tracks and clearing the queue.
 */

import { usePlayer } from '../contexts/PlayerContext';

export default function QueuePanel() {
    const { queue, queueIndex, playTrack, setQueue, setQueueIndex } = usePlayer();

    const handleRemoveTrack = (e, index) => {
        e.stopPropagation();
        const newQueue = [...queue];
        newQueue.splice(index, 1);

        let newIndex = queueIndex;
        if (index < queueIndex) {
            newIndex--;
        } else if (index === queueIndex && newQueue.length === 0) {
            newIndex = -1; // Queue empty
        } else if (index === queueIndex && index === newQueue.length) {
            newIndex--; // Last track was playing, fallback to new last
        }

        setQueue(newQueue);
        setQueueIndex(newIndex);
    };

    const handleClearQueue = () => {
        setQueue([]);
        setQueueIndex(-1);
    };

    // Very simple move up/down implementation for reordering (since HTML5 drag/drop is complex for a simple list)
    const handleMoveUp = (e, index) => {
        e.stopPropagation();
        if (index === 0) return;
        const newQueue = [...queue];
        [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];

        let newIndex = queueIndex;
        if (queueIndex === index) newIndex = index - 1;
        else if (queueIndex === index - 1) newIndex = index;

        setQueue(newQueue);
        setQueueIndex(newIndex);
    };

    const handleMoveDown = (e, index) => {
        e.stopPropagation();
        if (index === queue.length - 1) return;
        const newQueue = [...queue];
        [newQueue[index + 1], newQueue[index]] = [newQueue[index], newQueue[index + 1]];

        let newIndex = queueIndex;
        if (queueIndex === index) newIndex = index + 1;
        else if (queueIndex === index + 1) newIndex = index;

        setQueue(newQueue);
        setQueueIndex(newIndex);
    };

    return (
        <div className="queue-panel" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 className="section-title">Playback Queue</h1>
                    <p className="section-subtitle">{queue.length} tracks</p>
                </div>
                {queue.length > 0 && (
                    <button className="btn btn--danger" onClick={handleClearQueue} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                        Clear Queue
                    </button>
                )}
            </div>

            {queue.length > 0 ? (
                <div className="track-list">
                    {queue.map((track, i) => (
                        <div
                            key={track.video_id + '-' + i}
                            className={`track-list-item ${i === queueIndex ? 'track-list-item--active' : ''}`}
                            onClick={() => playTrack(track, queue, i)}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 8 }}
                        >
                            <span className="track-list-item__index" style={{ color: i === queueIndex ? 'var(--accent-primary)' : 'var(--text-muted)', width: 24, textAlign: 'center' }}>
                                {i === queueIndex ? '▶' : i + 1}
                            </span>
                            <img
                                src={track.thumbnail || `https://img.youtube.com/vi/${track.video_id}/hqdefault.jpg`}
                                alt=""
                                style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                            />
                            <div className="track-list-item__info" style={{ flex: 1, minWidth: 0 }}>
                                <div className="track-list-item__title" style={{ color: i === queueIndex ? 'var(--accent-primary)' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {track.title}
                                </div>
                                <div className="track-list-item__artist" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {track.artist}
                                </div>
                            </div>

                            {/* Reorder and Delete Controls */}
                            <div className="track-list-item__actions" style={{ display: 'flex', gap: 4 }}>
                                <button
                                    className="btn--icon"
                                    onClick={(e) => handleMoveUp(e, i)}
                                    disabled={i === 0}
                                    style={{ opacity: i === 0 ? 0.3 : 1, width: 28, height: 28, fontSize: '1rem' }}
                                    title="Move Up"
                                >
                                    ↑
                                </button>
                                <button
                                    className="btn--icon"
                                    onClick={(e) => handleMoveDown(e, i)}
                                    disabled={i === queue.length - 1}
                                    style={{ opacity: i === queue.length - 1 ? 0.3 : 1, width: 28, height: 28, fontSize: '1rem' }}
                                    title="Move Down"
                                >
                                    ↓
                                </button>
                                <button
                                    className="btn--icon"
                                    onClick={(e) => handleRemoveTrack(e, i)}
                                    style={{ width: 28, height: 28, fontSize: '1rem', color: '#f87171' }}
                                    title="Remove from Queue"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state" style={{ marginTop: 40, textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', opacity: 0.5, marginBottom: 16 }}>🎵</div>
                    <p style={{ color: 'var(--text-secondary)' }}>Your queue is empty.</p>
                </div>
            )}
        </div>
    );
}
