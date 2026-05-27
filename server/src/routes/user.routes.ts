import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authJwt } from "../middleware/authJwt.js";
import { listUsers } from "../controllers/user.controller.js";

const router = Router();

router.get("/", authJwt, asyncHandler(listUsers));

export default router;
