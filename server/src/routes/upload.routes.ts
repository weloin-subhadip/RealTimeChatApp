import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authJwt } from "../middleware/authJwt.js";
import { upload } from "../middleware/upload.js";
import { uploadFile } from "../controllers/upload.controller.js";

const router = Router();

// Field name "file"; single file per request.
router.post("/", authJwt, upload.single("file"), asyncHandler(uploadFile));

export default router;
