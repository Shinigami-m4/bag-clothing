import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

const publicBlobToken = process.env.BLOB_PUBLIC_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
const assetCacheSeconds = 60 * 60 * 24 * 30;
const maxUploadSizeBytes = 50 * 1024 * 1024;

export async function POST(req: Request) {
  if (!publicBlobToken) {
    return NextResponse.json(
      { error: "BLOB_PUBLIC_READ_WRITE_TOKEN is not configured." },
      { status: 500 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid upload request body." }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      token: publicBlobToken,
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("uploads/")) {
          throw new Error("Invalid upload path.");
        }

        return {
          addRandomSuffix: false,
          allowOverwrite: true,
          allowedContentTypes: ["image/*"],
          cacheControlMaxAge: assetCacheSeconds,
          maximumSizeInBytes: maxUploadSizeBytes,
        };
      },
    });

    return NextResponse.json(json);
  } catch (error) {
    console.error("Admin upload token generation failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to prepare upload.",
      },
      { status: 400 },
    );
  }
}
