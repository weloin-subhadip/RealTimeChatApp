import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authJwt } from "../middleware/authJwt.js";
import { search } from "../controllers/search.controller.js";

const router = Router();

router.get("/", authJwt, asyncHandler(search));

export default router;
