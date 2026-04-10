/**
 * 架构验证示例
 * 演示如何使用三个底座构建 Reply Agent
 */

import { AIProviderFactory } from '../ai/index.js';
import { EmptyKnowledgeBase } from '../knowledge/index.js';
import { ReplyAgent } from '../agents/index.js';

// 示例：创建 Reply Agent 实例
async function createReplyAgentExample() {
  // 1. 创建 AI Provider（通过工厂，不写死具体实现）
  const aiProvider = AIProviderFactory.create('claude', {
    apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
    defaultModel: 'claude-3-5-sonnet-20241022',
  });

  // 2. 创建知识库（第一阶段使用空实现，第二阶段可替换）
  const knowledgeBase = new EmptyKnowledgeBase();

  // 3. 创建 Reply Agent（依赖接口，不依赖具体实现）
  const replyAgent = new ReplyAgent(aiProvider, knowledgeBase);

  return replyAgent;
}

// 示例：使用 Reply Agent 生成回复
async function generateReplyExample() {
  const agent = await createReplyAgentExample();

  // 不传 options（向后兼容）
  const result1 = await agent.generateReply('Great post!');
  console.log('Reply without options:', result1);

  // 传入 role 参数（支持不同角色）
  const result2 = await agent.generateReply('How does this work?', {
    role: 'technical expert',
    temperature: 0.7,
  });
  console.log('Reply with role:', result2);
}

export { createReplyAgentExample, generateReplyExample };
