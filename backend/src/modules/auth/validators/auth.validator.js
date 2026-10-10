// backend/src/modules/auth/validators/auth.validator.js
// Zod schemas for all auth endpoints.
// The controller calls validate() before reaching the service layer.

'use strict';

const { z } = require('zod');

// ─── Shared field definitions ─────────────────────────────────────────────────

const emailField = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Must be a valid email address')
  .max(255, 'Email must not exceed 255 characters');

const passwordField = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters');

const nameField = z
  .string({ required_error: 'Name is required' })
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(150, 'Name must not exceed 150 characters');

const graduationYearField = z
  .number({ required_error: 'Graduation year is required', invalid_type_error: 'Graduation year must be a number' })
  .int()
  .min(1950, 'Graduation year must be 1950 or later')
  .max(2100, 'Graduation year must be 2100 or earlier');

// ─── Register ─────────────────────────────────────────────────────────────────
// The register schema handles both STUDENT and ALUMNI roles.
// Alumni must also supply company and designation.
// The departmentId must be a valid UUID — the service verifies it exists.

const registerSchema = z
  .object({
    name: nameField,
    email: emailField,
    password: passwordField,
    confirmPassword: z.string({ required_error: 'Please confirm your password' }),
    role: z.enum(['STUDENT', 'ALUMNI'], {
      required_error: 'Role is required',
      invalid_type_error: "Role must be 'STUDENT' or 'ALUMNI'",
    }),
    departmentId: z
      .string({ required_error: 'Department is required' })
      .min(1, 'Department is required'),
    graduationYear: graduationYearField,
    bio: z.string().trim().max(1000, 'Bio must not exceed 1000 characters').optional(),
    careerInterests: z.string().trim().max(500).optional(),

    // Alumni-only fields (required when role = ALUMNI)
    company: z
      .string()
      .trim()
      .max(200, 'Company name must not exceed 200 characters')
      .optional(),
    designation: z
      .string()
      .trim()
      .max(200, 'Designation must not exceed 200 characters')
      .optional(),
    experienceYears: z
      .number()
      .min(0, 'Experience years must be 0 or greater')
      .max(60)
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Passwords must match
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        path: ['confirmPassword'],
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
      });
    }

    // Alumni must provide company
    if (data.role === 'ALUMNI' && (!data.company || data.company.trim() === '')) {
      ctx.addIssue({
        path: ['company'],
        code: z.ZodIssueCode.custom,
        message: 'Company name is required for alumni',
      });
    }
  });

// ─── Login ────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

// ─── Validate helper ──────────────────────────────────────────────────────────

/**
 * Validates data against a Zod schema.
 * Returns { success, data, errors } — never throws.
 *
 * @param {z.ZodSchema} schema
 * @param {unknown} data
 */
function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data, errors: null };
  }

  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  }));

  return { success: false, data: null, errors };
}

module.exports = {
  registerSchema,
  loginSchema,
  validate,
};
