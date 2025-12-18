//@/components/WatchlistButton.tsx

'use client';

import {
    addToWatchlist,
    removeFromWatchlist,
} from '@/lib/actions/watchlist.actions';
import { Star, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';

interface WatchlistButtonProps {
    symbol: string;
    company: string;
    isInWatchlist: boolean;
    showTrashIcon?: boolean;
    type?: 'button' | 'icon';
    onWatchlistChange?: (symbol: string, isInWatchlist: boolean) => void;
}

const WatchlistButton = ({
                             symbol,
                             company,
                             isInWatchlist,
                             showTrashIcon = false,
                             type = 'button',
                             onWatchlistChange,
                         }: WatchlistButtonProps) => {
    const [added, setAdded] = useState<boolean>(isInWatchlist);
    const [loading, setLoading] = useState(false);

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (loading) return;

        const nextState = !added;
        setAdded(nextState);
        setLoading(true);

        try {
            const result = nextState
                ? await addToWatchlist(symbol, company)
                : await removeFromWatchlist(symbol);

            if (!result?.success) {
                throw new Error(result?.error || 'Watchlist update failed');
            }

            toast.success(
                nextState ? 'Added to Watchlist' : 'Removed from Watchlist',
                {
                    description: `${company} ${
                        nextState ? 'added to' : 'removed from'
                    } your watchlist`,
                }
            );

            onWatchlistChange?.(symbol, nextState);
        } catch (error) {
            // rollback UI
            setAdded(!nextState);

            toast.error('Something went wrong', {
                description: 'Could not update your watchlist. Please try again.',
            });
        } finally {
            setLoading(false);
        }
    };

    if (type === 'icon') {
        return (
            <button
                title={
                    added
                        ? `Remove ${symbol} from watchlist`
                        : `Add ${symbol} to watchlist`
                }
                aria-label={
                    added
                        ? `Remove ${symbol} from watchlist`
                        : `Add ${symbol} to watchlist`
                }
                className={`watchlist-icon-btn ${
                    added ? 'watchlist-icon-added' : ''
                }`}
                onClick={handleClick}
                disabled={loading}
            >
                <Star fill={added ? 'currentColor' : 'none'} />
            </button>
        );
    }

    return (
        <button
            className={`watchlist-btn ${added ? 'watchlist-remove' : ''}`}
            onClick={handleClick}
            disabled={loading}
        >
            {showTrashIcon && added ? <Trash2 /> : null}
            <span>
                {added ? 'Remove from Watchlist' : 'Add to Watchlist'}
            </span>
        </button>
    );
};

export default WatchlistButton;
