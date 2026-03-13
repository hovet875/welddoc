type DocumentFooterProps = {
  left?: string;
  right?: string;
};

export function DocumentFooter({ left, right }: DocumentFooterProps) {
  if (!left && !right) return null;

  return (
    <footer className="doc-footer">
      <div>{left ?? ""}</div>
      <div>{right ?? ""}</div>
    </footer>
  );
}