import { useEffect, useMemo, useState } from 'react';
import type { CommentInput } from '../../domain/commentInput';
import { commentInputRepository } from '../../data/commentInputRepositoryInstance';
import { roleRepository } from '../../data/roleRepositoryInstance';
import { platformState } from '../../data/platformState';
import type { Role } from '../../domain/role';
import type { CandidateReply } from '../../domain/candidateReply';
import { useReplyGeneration } from './useReplyGeneration';
import ReplyGenerationTrigger from './ReplyGenerationTrigger';
import CandidateReplyList from './CandidateReplyList';
import ReplyGenerationMetadata from './ReplyGenerationMetadata';

export default function ReplyGenerationView() {
  const [commentInputs, setCommentInputs] = useState<CommentInput[]>([]);
  const [selectedCommentId, setSelectedCommentId] = useState<string>('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [generationCount, setGenerationCount] = useState(3);
  const [selectedReply, setSelectedReply] = useState<CandidateReply | null>(null);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const { generateReplies, isGenerating, replies, error, trace } = useReplyGeneration();

  useEffect(() => {
    const loadCommentInputs = async () => {
      setIsLoadingComments(true);
      try {
        const results = await commentInputRepository.findAll();
        setCommentInputs(results);
        if (results.length > 0 && !selectedCommentId) {
          setSelectedCommentId(results[0].id);
        }
      } finally {
        setIsLoadingComments(false);
      }
    };

    void loadCommentInputs();
  }, [selectedCommentId]);

  const selectedComment =
    commentInputs.find((commentInput) => commentInput.id === selectedCommentId) ?? null;

  useEffect(() => {
    const loadRoles = async () => {
      if (!selectedComment) {
        setRoles([]);
        setSelectedRoleId('');
        return;
      }

      const workspaceRoles = await roleRepository.findByWorkspace(
        selectedComment.workspaceId
      );
      setRoles(workspaceRoles);
      if (!workspaceRoles.some((role) => role.id === selectedRoleId)) {
        setSelectedRoleId('');
      }
    };

    void loadRoles();
  }, [selectedComment, selectedRoleId]);

  useEffect(() => {
    setSelectedReply(replies[0] ?? null);
  }, [replies]);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const accountLabel = useMemo(() => {
    if (!selectedComment) {
      return undefined;
    }

    const account = platformState
      .getAccounts(selectedComment.workspaceId)
      .find((item) => item.id === selectedComment.accountId);

    return account ? `${account.displayName} (${account.handle})` : selectedComment.accountId;
  }, [selectedComment]);

  return (
    <div className="reply-generation-layout">
      <section className="panel reply-panel">
        <p className="panel-title">Comment Inputs</p>
        {isLoadingComments ? (
          <p className="muted">Loading comment inputs...</p>
        ) : commentInputs.length === 0 ? (
          <p className="muted">No comment inputs available for reply generation.</p>
        ) : (
          <div className="comment-selection-list">
            {commentInputs.map((commentInput) => (
              <button
                key={commentInput.id}
                type="button"
                className={`comment-selection-card ${selectedCommentId === commentInput.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedCommentId(commentInput.id)}
              >
                <strong>{commentInput.content}</strong>
                <p className="muted">
                  {commentInput.accountId}
                  {' · '}
                  {commentInput.workspaceId}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <ReplyGenerationTrigger
        selectedComment={selectedComment}
        roles={roles}
        selectedRoleId={selectedRoleId}
        generationCount={generationCount}
        isGenerating={isGenerating}
        error={error}
        onRoleChange={setSelectedRoleId}
        onGenerationCountChange={setGenerationCount}
        onGenerate={() => {
          if (!selectedComment) {
            return;
          }

          void generateReplies(
            selectedComment,
            selectedRoleId || undefined,
            generationCount,
            selectedRole?.name
          );
        }}
      />

      <CandidateReplyList
        replies={replies}
        selectedReplyId={selectedReply?.id ?? null}
        isGenerating={isGenerating}
        onSelectReply={setSelectedReply}
      />

      <ReplyGenerationMetadata
        reply={selectedReply}
        commentInput={trace?.commentInput ?? selectedComment}
        roleName={trace?.roleName ?? selectedRole?.name}
        accountLabel={accountLabel}
      />
    </div>
  );
}
