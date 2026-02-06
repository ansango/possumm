import { z } from "zod";

export const ErrorSchema = z.object({
  error: z.string(),
});

export const SuccessSchema = z.object({
  success: z.boolean(),
});

export const IdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID must be a number").transform(Number).openapi({
    param: {
      name: "id",
      in: "path",
      required: true,
      example: "1",
    },
    example: "1",
  }),
});
