import { useEffect, useState } from 'react';
import type { CommentInput } from '../../domain/commentInput';
import type { ICommentInputRepository } from '../../data/commentInputRepository';

type CommentInputListProps = {
  repository: ICommentInputRepository;
  workspaceId?: string;
  accountId?: string;
};

export default function CommentInputList({ repository, workspaceId, accountId }: CommentInputListProps) {
  const [inputs, setInputs] = useState<CommentInput[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInputs = async () => {
      setLoading(true);
      try {
        let results: CommentInput[];
        if (accountId) {
          results = await repository.findByAccountId(accountId);
        } else if (workspaceId) {
          results = await repository.findByWorkspaceId(workspaceId);
        } else {
          results = await repository.findAll();
        }
        setInputs(results);
      } catch (error) {
        console.error('Failed to load comment inputs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInputs();
  }, [repository, workspaceId, accountId]);

  if (loading) {
    return <p className="muted">Loading comment inputs...</p>;
  }

  if (inputs.length === 0) {
    return (
      <div className="panel">
        <p className="muted">No comment inputs found. Use mock input pipeline to add test data.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <p className="panel-title">Comment Inputs ({inputs.length})</p>
      {inputs.map((input) => (
        <div key={input.id} className="platform-item comment-input-item">
          <div className="comment-input-content">
            <p><strong>{input.content}</strong></p>
          </div>
          <div className="comment-input-meta">
            <p className="muted">
              <span>Workspace: {input.workspaceId}</span>
              {' • '}
              <span>Account: {input.accountId}</span>
            </p>
            {input.targetTweetId && (
              <p className="muted">Target Tweet: {input.targetTweetId}</p>
            )}
            {input.metadata?.source && (
              <p className="muted">Source: {input.metadata.source as string}</p>
            )}
            <p className="muted">Created: {new Date(input.createdAt).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
