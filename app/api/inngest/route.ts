import {serve} from "inngest/next";
import { inngest } from "@/lib/inngst/client";
import {sendDailyNewsSummary, sendSignUpEmail} from "@/lib/inngst/function";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [sendSignUpEmail, sendDailyNewsSummary],
})