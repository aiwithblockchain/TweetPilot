type NavigationItem = {
	id: string;
	label: string;
	active?: boolean;
};

type NavigationProps = {
	items: NavigationItem[];
	onNavigate?: (id: string) => void;
};

export default function Navigation({ items, onNavigate }: NavigationProps) {
	return (
		<nav className="nav">
			{items.map((item) => (
				<button
					type="button"
					key={item.id}
					className={`nav-item ${item.active ? "is-active" : ""}`}
					onClick={() => onNavigate?.(item.id)}
				>
					{item.label}
				</button>
			))}
		</nav>
	);
}
