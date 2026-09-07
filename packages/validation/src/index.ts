import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20),
  q: z.string().trim().max(80).catch(""),
});

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

export const resetPasswordSchema = z.object({
  email: z.email("Informe um e-mail válido."),
});

export const strongPasswordSchema = z
  .string()
  .min(12, "Use pelo menos 12 caracteres.")
  .regex(/[A-Z]/, "Inclua uma letra maiúscula.")
  .regex(/[a-z]/, "Inclua uma letra minúscula.")
  .regex(/[0-9]/, "Inclua um número.")
  .regex(/[^A-Za-z0-9]/, "Inclua um símbolo.");

export const updatePasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "As senhas não coincidem.",
    path: ["confirmation"],
  });

export const materialMovementSchema = z
  .object({
    itemId: z.uuid(),
    originTeamId: z.uuid().nullable(),
    destinationTeamId: z.uuid().nullable(),
    quantity: z.coerce.number().int().positive().max(1_000_000),
    movementType: z.enum(["entry", "exit", "transfer", "return", "consumption", "replenishment"]),
    note: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.originTeamId || value.destinationTeamId, {
    message: "Informe uma origem ou um destino.",
  })
  .refine(
    (value) => !value.originTeamId || value.originTeamId !== value.destinationTeamId,
    { message: "Origem e destino devem ser diferentes." },
  );

export const assetMovementSchema = z.object({
  assetId: z.uuid(),
  destinationTeamId: z.uuid().nullable(),
  movementType: z.enum(["assign", "transfer", "return", "maintenance", "status_change"]),
  newStatus: z.enum(["available", "in_use", "maintenance", "damaged", "lost", "retired"]),
  note: z.string().trim().max(500).optional(),
});

export const materialCreateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(80).optional(),
  unit: z.string().trim().min(1).max(20),
  minimumStock: z.coerce.number().int().min(0).max(1_000_000),
  teamId: z.uuid(),
  quantity: z.coerce.number().int().positive().max(1_000_000),
});

export const materialUpdateSchema = z.object({
  itemId: z.uuid(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(80).optional(),
  unit: z.string().trim().min(1).max(20),
  minimumStock: z.coerce.number().int().min(0).max(1_000_000),
});

export const equipmentCreateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(120),
  assetCode: z.string().trim().min(1).max(80),
  serialNumber: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(80).optional(),
  teamId: z.uuid(),
  notes: z.string().trim().max(500).optional(),
  ownershipType: z.enum(["owned", "rented"]),
  rentalCompany: z.string().trim().max(160).optional(),
  rentalStartDate: z.iso.date().nullable(),
  rentalEndDate: z.iso.date().nullable(),
}).refine((value) => value.ownershipType !== "rented" || Boolean(value.rentalCompany), {
  message: "Informe a empresa locadora.", path: ["rentalCompany"],
}).refine((value) => !value.rentalStartDate || !value.rentalEndDate || value.rentalEndDate >= value.rentalStartDate, {
  message: "O fim previsto deve ser posterior ao início.", path: ["rentalEndDate"],
});

export const equipmentUpdateSchema = z.object({
  itemId: z.uuid(),
  assetId: z.uuid(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(120),
  assetCode: z.string().trim().min(1).max(80),
  serialNumber: z.string().trim().max(120).optional(),
  teamId: z.uuid(),
  status: z.enum(["available", "in_use", "maintenance", "damaged", "lost", "retired"]),
  notes: z.string().trim().max(500).optional(),
  ownershipType: z.enum(["owned", "rented"]),
  rentalCompany: z.string().trim().max(160).optional(),
  rentalStartDate: z.iso.date().nullable(),
  rentalEndDate: z.iso.date().nullable(),
}).refine((value) => value.ownershipType !== "rented" || Boolean(value.rentalCompany), {
  message: "Informe a empresa locadora.", path: ["rentalCompany"],
}).refine((value) => !value.rentalStartDate || !value.rentalEndDate || value.rentalEndDate >= value.rentalStartDate, {
  message: "O fim previsto deve ser posterior ao início.", path: ["rentalEndDate"],
});

export const epiItemCreateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(2).max(140),
  kind: z.enum(["epi", "uniform", "personal_tool"]),
  unit: z.string().trim().min(1).max(20),
  caNumber: z.string().trim().max(60).optional(),
  brandModel: z.string().trim().max(140).optional(),
  minimumStock: z.coerce.number().int().min(0).max(1_000_000),
  initialQuantity: z.coerce.number().int().min(0).max(1_000_000),
  variant: z.string().trim().max(80).optional(),
  lotNumber: z.string().trim().max(100).optional(),
});

export const epiItemUpdateSchema = z.object({
  itemId: z.uuid(),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(2).max(140),
  kind: z.enum(["epi", "uniform", "personal_tool"]),
  unit: z.string().trim().min(1).max(20),
  caNumber: z.string().trim().max(60).optional(),
  brandModel: z.string().trim().max(140).optional(),
  minimumStock: z.coerce.number().int().min(0).max(1_000_000),
});

export const epiStockCreateSchema = z.object({
  itemId: z.uuid(),
  quantity: z.coerce.number().int().positive().max(1_000_000),
  variant: z.string().trim().max(80).optional(),
  caNumber: z.string().trim().max(60).optional(),
  brandModel: z.string().trim().max(140).optional(),
  lotNumber: z.string().trim().max(100).optional(),
});

export const profileUpdateSchema = z.object({
  userId: z.uuid(),
  fullName: z.string().trim().min(2).max(140),
  role: z.enum(["admin", "engineer", "leader", "collaborator"]),
  teamId: z.uuid().nullable(),
  active: z.boolean(),
}).refine((value) => !["leader", "collaborator"].includes(value.role) || value.teamId, {
  message: "Líderes e colaboradores precisam de uma equipe.",
  path: ["teamId"],
});

export const teamCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300).optional(),
  locationType: z.enum(["central", "field"]),
});

export const employeeCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(140),
  registrationCode: z.string().trim().max(40).optional(),
  profession: z.string().trim().min(1).max(80),
  teamId: z.uuid(),
  shirtSize: z.enum(["M", "G", "GG", "XG", "XXG"]).nullable(),
  pantsSize: z.enum(["M", "G", "GG", "XG", "XXG"]).nullable(),
  shoeSize: z.enum(["38", "39", "40", "41", "42", "43", "44", "45", "46"]).nullable(),
  asoExamDate: z.iso.date().nullable(),
  asoExpiryDate: z.iso.date().nullable(),
}).refine((value) => !value.asoExamDate || !value.asoExpiryDate || value.asoExpiryDate >= value.asoExamDate, {
  message: "A validade do ASO deve ser posterior ao exame.",
  path: ["asoExpiryDate"],
});

export const employeeUpdateSchema = employeeCreateSchema.safeExtend({
  employeeId: z.uuid(),
  active: z.boolean(),
});

export const epiDeliverySchema = z.object({
  employeeId: z.uuid(),
  itemId: z.uuid(),
  stockBatchId: z.uuid(),
  quantity: z.coerce.number().int().positive().max(1000),
  reason: z.enum(["initial", "replacement", "additional"]),
  note: z.string().trim().max(500).optional(),
});

export const epiDeliveryCloseSchema = z.object({
  deliveryId: z.uuid(),
  employeeId: z.uuid(),
  quantity: z.coerce.number().int().positive().max(1000),
  status: z.enum(["returned", "replaced", "lost", "damaged", "consumed"]),
});
