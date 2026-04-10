import { createRole } from "../domain/role";
import { candidateReplyRepository } from "./candidateReplyRepositoryInstance";
import { InMemoryRoleRepository } from "./repositories/InMemoryRoleRepository";

export const roleRepository = new InMemoryRoleRepository(
	candidateReplyRepository,
);

const defaultWorkspaceRoles = [
	createRole({
		name: "专业客服",
		description: "适合处理售后、咨询和标准服务场景。",
		prompt:
			"你是一名专业客服，回复要稳定、礼貌、可执行，优先澄清问题并提供下一步动作。",
		workspaceId: "ws-001",
		metadata: { tone: "professional" },
	}),
	createRole({
		name: "友好助手",
		description: "适合社区互动、轻量答复和关系维护。",
		prompt: "你是一名友好助手，回复应亲切自然、积极回应用户情绪，并保持简洁。",
		workspaceId: "ws-001",
		metadata: { tone: "friendly" },
	}),
	createRole({
		name: "增长运营",
		description: "适合活动推广、用户引导和转化型回复。",
		prompt:
			"你是一名增长运营，回复应突出价值、行动引导和活动信息，但避免过度营销。",
		workspaceId: "ws-002",
		metadata: { tone: "growth" },
	}),
];

defaultWorkspaceRoles.forEach((role) => {
	void roleRepository.save(role);
});

void roleRepository.bindRole("acc-001", defaultWorkspaceRoles[0].id, true);
void roleRepository.bindRole("acc-001", defaultWorkspaceRoles[1].id, false);
void roleRepository.bindRole("acc-002", defaultWorkspaceRoles[2].id, true);
