// File: app/watchlist/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import WatchlistButton from "@/components/WatchlistButton";

type Item = { _id?: string; symbol: string; company?: string };

export default function WatchlistPage() {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        fetchList();
    }, []);

    async function fetchList() {
        setLoading(true);
        setErr(null);
        try {
            const res = await fetch("/api/watchlist", { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to load");
            const data = await res.json();
            setItems(data.items || []);
        } catch (e: any) {
            setErr(e.message || "Error");
        } finally {
            setLoading(false);
        }
    }

    async function addToWatchlist(symbol: string, company?: string) {
        try {
            const res = await fetch("/api/watchlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbol, company }),
            });
            if (!res.ok) throw new Error("Add failed");
            const { item } = await res.json();
            setItems((prev) => [item, ...prev]);
        } catch (e) {
            console.error(e);
        }
    }

    async function removeFromWatchlist(symbol: string) {
        try {
            const res = await fetch("/api/watchlist", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbol }),
            });
            if (!res.ok) throw new Error("Remove failed");
            setItems((prev) => prev.filter((i) => i.symbol !== symbol));
        } catch (e) {
            console.error(e);
        }
    }

    async function toggle(symbol: string, company: string | undefined, next: boolean) {
        if (next) await addToWatchlist(symbol, company);
        else await removeFromWatchlist(symbol);
    }

    async function exportCsv() {
        try {
            const res = await fetch("/api/watchlist?export=csv");
            if (!res.ok) throw new Error("Export failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "watchlist.csv";
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
        }
    }

    if (loading) return <div className="p-4">Loading watchlist...</div>;
    if (err) return <div className="p-4 text-red-600">Error: {err}</div>;

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-semibold">My Watchlist</h1>
                <button className="btn" onClick={exportCsv}>
                    Export CSV
                </button>
            </div>

            {items.length === 0 ? (
                <div>No items in watchlist.</div>
            ) : (
                <ul className="space-y-2">
                    {items.map((it) => (
                        <li key={it.symbol} className="flex items-center justify-between p-2 border rounded">
                            <div>
                                <div className="font-medium">{it.symbol}</div>
                                <div className="text-sm text-muted-foreground">{it.company}</div>
                            </div>
                            <WatchlistButton
                                symbol={it.symbol}
                                company={it.company}
                                isInWatchlist={true}
                                showTrashIcon={true}
                                onWatchlistChange={(symbol, next) => toggle(symbol, it.company, next)}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
