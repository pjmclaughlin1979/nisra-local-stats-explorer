import SearchBar from "./SearchBar.jsx";

export default function Header({ geo }) {
  return (
    <header className="site-header">
      <div className="banner">
        Unofficial demo built on NISRA open data. Not affiliated with NISRA or any statistics office.
      </div>
      <div className="masthead">
        <a className="wordmark" href="#/" aria-label="NI Statistics Profiles home">
          <span className="wordmark__small">Northern Ireland</span>
          <span className="wordmark__big">Statistics</span>
          <span className="wordmark__small">Profiles</span>
        </a>
        <div className="masthead__search">{geo && <SearchBar geo={geo} />}</div>
      </div>
      <nav className="tabs" aria-label="Sections">
        <a href="#/" aria-current="page">Profiles</a>
        <a href="../react/">Local Statistics Explorer</a>
        <a href="https://data.nisra.gov.uk/">Data Portal</a>
      </nav>
    </header>
  );
}
