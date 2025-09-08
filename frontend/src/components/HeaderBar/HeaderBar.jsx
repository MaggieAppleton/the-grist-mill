import { useEffect, useRef, useState } from "react";
import { Search as SearchIcon, Settings as SettingsIcon, RefreshCcw, DollarSign } from "lucide-react";

function SearchBar({ onSearch, onClear, isLoading, currentQuery }) {
	const [query, setQuery] = useState("");
	const [isExpanded, setIsExpanded] = useState(false);
	const inputRef = useRef(null);

	useEffect(() => {
		setQuery(currentQuery || "");
	}, [currentQuery]);

	function handleSubmit(e) {
		e.preventDefault();
		if (!isExpanded && !query.trim()) {
			setIsExpanded(true);
			requestAnimationFrame(() => inputRef.current?.focus());
			return;
		}
		onSearch(query);
	}

	function handleClear() {
		setQuery("");
		onClear();
		setIsExpanded(false);
	}

	function handleInputChange(e) {
		const value = e.target.value;
		setQuery(value);
		if (value.trim().length === 0) {
			onClear();
		}
	}

	function handleSearchButtonMouseDown(e) {
		if (!isExpanded && !query.trim()) {
			e.preventDefault();
			setIsExpanded(true);
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}

	function handleInputBlur() {
		setTimeout(() => {
			if (document.activeElement !== inputRef.current && !query.trim()) {
				setIsExpanded(false);
			}
		}, 0);
	}

	function handleInputKeyDown(e) {
		if (e.key === "Escape") {
			if (!query.trim()) {
				setIsExpanded(false);
			}
			inputRef.current?.blur();
		}
	}

	return (
		<form
			className={`search-form${!isExpanded && !query ? " collapsed" : ""}`}
			onSubmit={handleSubmit}
		>
			<div className="search-input-group">
				<div className="search-field">
					<button
						type="submit"
						className="search-icon-button"
						disabled={isLoading}
						title="Search"
						onMouseDown={handleSearchButtonMouseDown}
					>
						{isLoading ? (
							"..."
						) : (
							<SearchIcon size={16} aria-hidden color="var(--dark-3)" />
						)}
					</button>
					<input
						type="text"
						className="search-input"
						placeholder="Search stories..."
						value={query}
						onChange={handleInputChange}
						disabled={isLoading}
						ref={inputRef}
						onFocus={() => setIsExpanded(true)}
						onBlur={handleInputBlur}
						onKeyDown={handleInputKeyDown}
					/>
					{query && (
						<button
							type="button"
							className="clear-input-button"
							onClick={handleClear}
							disabled={isLoading}
							title="Clear search"
						>
							×
						</button>
					)}
				</div>
			</div>
		</form>
	);
}

export default function HeaderBar({
	onSearch,
	onClear,
	isSearching,
	currentQuery,
	isRefreshing,
	onRefresh,
	onOpenUsage,
	onOpenSettings,
	searchResults,
	searchError,
}) {
	const isShowingSearchResults = !!searchResults;
	return (
		<div className="header-controls">
			<div className="search-controls">
				<SearchBar
					onSearch={onSearch}
					onClear={onClear}
					isLoading={isSearching}
					currentQuery={currentQuery}
				/>
				{isShowingSearchResults && searchResults && (
					<div className="search-status">
						<span className="search-results-info">
							Found {searchResults.count} results for "{searchResults.query}"
						</span>
						{searchResults.count > 0 && (
							<button
								className="clear-search-button"
								onClick={onClear}
								title="Clear search"
							>
								× Clear
							</button>
						)}
					</div>
				)}
				{searchError && (
					<div className="error-alert search-error" role="alert">
						Search error: {searchError}
					</div>
				)}
			</div>
			<div className="button-group">
				{isRefreshing && (
					<span className="refreshing-inline" aria-live="polite">
						Refreshing…
					</span>
				)}
				<button
					className="toolbar-icon-button"
					onClick={onRefresh}
					disabled={isRefreshing}
					title="Manually refresh stories"
				>
					{isRefreshing ? (
						<span className="spinner" aria-hidden />
					) : (
						<RefreshCcw size={18} aria-hidden color="var(--dark-3)" />
					)}
				</button>
				<button
					className="toolbar-icon-button"
					title="View AI usage"
					onClick={onOpenUsage}
					aria-label="View AI usage"
				>
					<DollarSign size={18} aria-hidden color="var(--dark-3)" />
				</button>
				<button
					className="toolbar-icon-button"
					title="Settings"
					onClick={onOpenSettings}
					aria-label="Settings"
				>
					<SettingsIcon size={18} aria-hidden color="var(--dark-3)" />
				</button>
			</div>
		</div>
	);
}


