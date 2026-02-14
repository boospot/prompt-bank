import { PromptStatus, PromptVisibility } from "@prisma/client";
import { z } from "zod";

export const promptSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(120, "Title can be at most 120 characters."),
  description: z
    .string()
    .trim()
    .max(300, "Description can be at most 300 characters.")
    .optional()
    .or(z.literal("")),
  content: z
    .string()
    .trim()
    .min(10, "Prompt content must be at least 10 characters.")
    .max(10000, "Prompt content can be at most 10,000 characters."),
  categoryId: z.string().trim().min(1, "Category is required."),
  tagsCsv: z
    .string()
    .max(500, "Tags input is too long.")
    .optional()
    .or(z.literal("")),
  collaboratorEmailsCsv: z
    .string()
    .max(1000, "Collaborators input is too long.")
    .optional()
    .or(z.literal("")),
  visibility: z.nativeEnum(PromptVisibility),
  status: z.nativeEnum(PromptStatus),
  isSaved: z.boolean().default(false),
});

export type PromptInput = z.infer<typeof promptSchema>;
