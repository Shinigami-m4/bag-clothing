export type ArtistId = "doom" | "spill" | "yearn" | "bunch";

export const artistConfig: Record<
  ArtistId,
  { name: string; bg: string; pieceImg: string }
> = {
  doom: { name: "DOOM", bg: "/bg/doom.jpeg", pieceImg: "/pieces/doom-1.jpg" },
  spill: { name: "SPILL", bg: "/bg/spill.jpeg", pieceImg: "/pieces/spill-1.jpg" },
  yearn: { name: "YEARN", bg: "/bg/yearn.jpeg", pieceImg: "/pieces/yearn-1.jpg" },
  bunch: { name: "BUNCH", bg: "/bg/bunch.jpeg", pieceImg: "/pieces/bunch-1.jpeg" },
};
