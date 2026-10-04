/* Pictures in: add_image copies a picture into SmartChart (from a public URL or the bytes), prepares it for its kind and
   returns the reference a slide takes. The work is the host's (api/_lib/images.ts); this is the tool's face. */
import { IMAGE_KINDS, type ImageKind } from "../slides/images.js";
import { ToolError, WRITE, tool } from "./types.js";

/** Where each kind of picture goes on a slide. */
const WHERE: Record<ImageKind, string> = {
  logo: "logos[].logo (a logos slide), a table's first-column cell { value, logo } or columns[].logo, or a card's logo lead",
  photo: "people[].photo (a team slide) or image (an image slide)",
  screenshot: "image (an image slide)",
};

export const imageTools = [
  tool<{ url?: string; data?: string; kind: ImageKind; alt?: string }>({ name: "add_image", title: "Add a picture", group: "images", scope: "account", annotations: WRITE,
    description: "Copy a picture into SmartChart from a public https URL (or base64 bytes) and get the reference a slide takes: { src }. kind: \"logo\" (a company's mark: drawn in one colour, its plain background removed, trimmed), \"photo\" (people, places: cropped to its frame) or \"screenshot\" (the product: never cropped). Pass a logo as a PNG or SVG on a plain or transparent background. Only use pictures the user gave or asked for. The same picture added twice returns the same src.",
    input: { type: "object", additionalProperties: false, required: ["kind"], properties: {
      url: { type: "string", description: "A public https link to the picture itself (not a web page)." },
      data: { type: "string", description: "The picture's bytes, base64, at most 3 MB. Instead of url; prefer url for anything larger." },
      kind: { type: "string", enum: IMAGE_KINDS, description: "logo, photo or screenshot." },
      alt: { type: "string", description: "What the picture shows, in one plain sentence. Required by the image slide; returned with the src." } } },
    run: async (ctx, { url, data, kind, alt }) => {
      if (!url === !data) throw new ToolError("bad_input", "Pass exactly one of url or data.", "url for a public link; data for base64 bytes.");
      const img = await ctx.port.addImage({ url, data, kind });
      const image = alt?.trim() ? { src: img.src, alt: alt.trim() } : { src: img.src };
      return { result: { image, kind: img.kind, width: img.width, height: img.height, next: `Put image (or { src } alone) in ${WHERE[img.kind]}.` } };
    } }),
];
