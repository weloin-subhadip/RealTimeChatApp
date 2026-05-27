import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateBody } from "../middleware/validate.js";
import { authJwt } from "../middleware/authJwt.js";
import * as ctrl from "../controllers/auth.controller.js";

const registerSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const router = Router();

router.post("/register", validateBody(registerSchema), asyncHandler(ctrl.register));
router.post("/login", validateBody(loginSchema), asyncHandler(ctrl.login));
router.post("/refresh", asyncHandler(ctrl.refresh));
router.post("/logout", asyncHandler(ctrl.logout));
router.get("/me", authJwt, asyncHandler(ctrl.me));

export default router;
