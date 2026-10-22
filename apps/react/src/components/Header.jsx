export default function Header() {
  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand" href="#/">
            <span className="brand__mark">NISRA</span>
          </a>
          <span className="site-header__title">
            Local Statistics Explorer
            <span className="framework-badge">React</span>
          </span>
        </div>
      </header>
      <p className="notice">
        Unofficial recreation of the NISRA Local Statistics Explorer, built on live NISRA open data.
      </p>
    </>
  );
}
