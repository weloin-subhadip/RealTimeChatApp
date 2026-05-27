import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authJwt } from "../middleware/authJwt.js";
import { validateBody } from "../middleware/validate.js";
import * as ctrl from "../controllers/conversation.controller.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const createSchema = z.object({ participantId: objectId });
const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  memberIds: z.array(objectId).min(1),
});
const addMemberSchema = z.object({ userId: objectId });
const renameSchema = z.object({ name: z.string().trim().min(1).max(100) });

const router = Router();
router.use(authJwt);

router.get("/", asyncHandler(ctrl.listConversations));
router.post("/", validateBody(createSchema), asyncHandler(ctrl.createConversation));
router.post("/group", validateBody(createGroupSchema), asyncHandler(ctrl.createGroup));
router.patch("/:id", validateBody(renameSchema), asyncHandler(ctrl.renameGroup));
router.post("/:id/members", validateBody(addMemberSchema), asyncHandler(ctrl.addMember));
router.delete("/:id/members/:userId", asyncHandler(ctrl.removeMember));
router.get("/:id/messages", asyncHandler(ctrl.getHistory));

export default router;
