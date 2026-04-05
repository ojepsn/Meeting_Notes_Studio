interface TodosRailCardProps {
  active: boolean;
  onOpen: () => void;
}

export const TodosRailCard = ({ active, onOpen }: TodosRailCardProps) => {
  return (
    <button
      type="button"
      className="workspace-nav-button"
      data-active={active}
      onClick={onOpen}
    >
      <span>Todos</span>
      <small>Focused follow-up management</small>
    </button>
  );
};
