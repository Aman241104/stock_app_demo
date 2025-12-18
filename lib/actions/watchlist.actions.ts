//@/lib/actions/watchlist.actions.ts

'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '../better-auth/auth';
import Watchlist from '@/database/models/watchlist.model';
import { getStocksDetails } from '@/lib/actions/finnhub.actions';

// -----------------------------
// Helpers
// -----------------------------

const getUserOrRedirect = async () => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) redirect('/sign-in');
    return session.user;
};

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();

// -----------------------------
// Add stock to watchlist
// -----------------------------

export const addToWatchlist = async (symbol: string, company: string) => {
    try {
        const user = await getUserOrRedirect();
        const normalizedSymbol = normalizeSymbol(symbol);

        const existingItem = await Watchlist.findOne({
            userId: user.id,
            symbol: normalizedSymbol,
        });

        if (existingItem) {
            return { success: false, error: 'Stock already in watchlist' };
        }

        const newItem = new Watchlist({
            userId: user.id,
            symbol: normalizedSymbol,
            company: company.trim(),
        });

        await newItem.save();
        revalidatePath('/watchlist');

        return { success: true, message: 'Stock added to watchlist' };
    } catch (error) {
        console.error('Error adding to watchlist:', error);
        throw new Error('Failed to add stock to watchlist');
    }
};

// -----------------------------
// Remove stock from watchlist
// -----------------------------

export const removeFromWatchlist = async (symbol: string) => {
    try {
        const user = await getUserOrRedirect();
        const normalizedSymbol = normalizeSymbol(symbol);

        const result = await Watchlist.deleteOne({
            userId: user.id,
            symbol: normalizedSymbol,
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Stock not found in watchlist' };
        }

        revalidatePath('/watchlist');
        return { success: true, message: 'Stock removed from watchlist' };
    } catch (error) {
        console.error('Error removing from watchlist:', error);
        throw new Error('Failed to remove stock from watchlist');
    }
};

// -----------------------------
// Get user's watchlist (raw)
// -----------------------------

export const getUserWatchlist = async () => {
    try {
        const user = await getUserOrRedirect();

        const watchlist = await Watchlist.find({ userId: user.id })
            .sort({ addedAt: -1 })
            .lean();

        return watchlist;
    } catch (error) {
        console.error('Error fetching watchlist:', error);
        throw new Error('Failed to fetch watchlist');
    }
};

// -----------------------------
// Get watchlist with live stock data
// -----------------------------

export const getWatchlistWithData = async () => {
    try {
        const user = await getUserOrRedirect();

        const watchlist = await Watchlist.find({ userId: user.id })
            .sort({ addedAt: -1 })
            .lean();

        if (watchlist.length === 0) return [];

        const stocksWithData = await Promise.all(
            watchlist.map(async (item) => {
                const stockData = await getStocksDetails(item.symbol);

                return {
                    company: stockData?.company ?? item.company,
                    symbol: item.symbol,
                    currentPrice: stockData?.currentPrice ?? null,
                    priceFormatted: stockData?.priceFormatted ?? 'N/A',
                    changeFormatted: stockData?.changeFormatted ?? 'N/A',
                    changePercent: stockData?.changePercent ?? null,
                    marketCap: stockData?.marketCapFormatted ?? 'N/A',
                    peRatio: stockData?.peRatio ?? null,
                };
            })
        );

        return stocksWithData;
    } catch (error) {
        console.error('Error loading watchlist:', error);
        throw new Error('Failed to fetch watchlist');
    }
};

// Get only symbols from user's watchlist (helper for search)
export const getWatchlistSymbolsByEmail = async (
    email: string
): Promise<string[]> => {
    try {
        const watchlist = await Watchlist.find(
            { email },
            { symbol: 1, _id: 0 }
        ).lean();

        return watchlist.map((item) => item.symbol);
    } catch (error) {
        console.error('Error fetching watchlist symbols:', error);
        return [];
    }
};
