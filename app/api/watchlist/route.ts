// File: app/api/watchlist/route.ts
import { NextRequest, NextResponse } from "next/server";
import {connectToDatabase} from "@/database/mongoose";
import WatchlistModel from "../../../database/models/watchlist.model";

await connectToDatabase();

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const exportCsv = req.nextUrl.searchParams.get("export") === "csv";
        const items = await WatchlistModel.find({ user: userId }).lean();

        if (exportCsv) {
            const header = "symbol,company\n";
            const rows = items.map((i: any) => `${i.symbol},${(i.company || "").replace(/,/g, " ")}`).join("\n");
            const csv = header + rows;
            return new NextResponse(csv, {
                status: 200,
                headers: {
                    "Content-Type": "text/csv",
                    "Content-Disposition": `attachment; filename="watchlist-${userId}.csv"`,
                },
            });
        }

        return NextResponse.json({ items });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { symbol, company } = body;
        if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

        const item = await WatchlistModel.findOneAndUpdate(
            { user: userId, symbol },
            { user: userId, symbol, company },
            { upsert: true, new: true }
        );

        return NextResponse.json({ item });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { symbol } = body;
        if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

        await WatchlistModel.deleteOne({ user: userId, symbol });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
