'use client';

import { useEffect, useState } from 'react';
import {
    CommandDialog,
    CommandEmpty,
    CommandInput,
    CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { searchStocksUser } from '@/lib/actions/finnhub.actions';
import { useDebounce } from '@/Hooks/UseDebounce';
import WatchlistButton from './WatchlistButton';

interface SearchCommandProps {
    renderAs?: 'button' | 'text';
    label?: string;
    initialStocks: StockWithWatchlistStatus[];
}

export default function SearchCommand({
                                          renderAs = 'button',
                                          label = 'Add stock',
                                          initialStocks,
                                      }: SearchCommandProps) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [stocks, setStocks] =
        useState<StockWithWatchlistStatus[]>(initialStocks);

    const isSearchMode = !!searchTerm.trim();
    const displayStocks = isSearchMode ? stocks : stocks.slice(0, 10);

    /* --------------------------------------------------
       Keyboard shortcut (Cmd/Ctrl + K)
    -------------------------------------------------- */
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen((v) => !v);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    /* --------------------------------------------------
       Search logic
    -------------------------------------------------- */
    const handleSearch = async () => {
        if (!isSearchMode) {
            setStocks(initialStocks);
            return;
        }

        const query = searchTerm.trim();
        setLoading(true);

        try {
            const results = await searchStocksUser(query);
            if (query === searchTerm.trim()) {
                setStocks(results);
            }
        } catch {
            setStocks([]);
        } finally {
            setLoading(false);
        }
    };

    const debouncedSearch = useDebounce(handleSearch, 300);

    useEffect(() => {
        debouncedSearch();
    }, [searchTerm, debouncedSearch]);

    /* --------------------------------------------------
       Helpers
    -------------------------------------------------- */
    const handleSelectStock = () => {
        setOpen(false);
        setSearchTerm('');
        setStocks(initialStocks);
    };

    const handleWatchlistChange = (symbol: string, isAdded: boolean) => {
        setStocks((prev) =>
            prev.map((stock) =>
                stock.symbol === symbol
                    ? { ...stock, isInWatchlist: isAdded }
                    : stock
            )
        );
    };

    /* --------------------------------------------------
       Render
    -------------------------------------------------- */
    return (
        <>
            {renderAs === 'text' ? (
                <span onClick={() => setOpen(true)} className="search-text">
                    {label}
                </span>
            ) : (
                <Button onClick={() => setOpen(true)} className="search-btn">
                    {label}
                </Button>
            )}

            <CommandDialog
                open={open}
                onOpenChange={setOpen}
                className="search-dialog"
            >
                <div className="search-field">
                    <CommandInput
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                        placeholder="Search stocks..."
                        className="search-input"
                    />
                    {loading && <Loader2 className="search-loader" />}
                </div>

                <CommandList className="search-list">
                    {loading ? (
                        <CommandEmpty className="search-list-empty">
                            Loading stocks...
                        </CommandEmpty>
                    ) : displayStocks.length === 0 ? (
                        <div className="search-list-indicator">
                            {isSearchMode
                                ? 'No results found'
                                : 'No stocks available'}
                        </div>
                    ) : (
                        <ul>
                            <div className="search-count">
                                {isSearchMode
                                    ? 'Search results'
                                    : 'Popular stocks'}{' '}
                                ({displayStocks.length})
                            </div>

                            {displayStocks.map((stock) => (
                                <li
                                    key={stock.symbol}
                                    className="search-item flex items-center justify-between"
                                >
                                    <Link
                                        href={`/stocks/${stock.symbol}`}
                                        onClick={handleSelectStock}
                                        className="search-item-link flex items-center gap-3 flex-1"
                                    >
                                        <TrendingUp className="h-4 w-4 text-gray-500" />
                                        <div className="flex-1">
                                            <div className="search-item-name">
                                                {stock.name}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {stock.symbol} | {stock.exchange} |{' '}
                                                {stock.type}
                                            </div>
                                        </div>
                                    </Link>

                                    <WatchlistButton
                                        symbol={stock.symbol}
                                        company={stock.name}
                                        isInWatchlist={stock.isInWatchlist}
                                        onWatchlistChange={handleWatchlistChange}
                                        type="icon"
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    );
}
