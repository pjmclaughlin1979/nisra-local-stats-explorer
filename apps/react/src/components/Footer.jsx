export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          Built with the ArcGIS Maps SDK for JavaScript 5.x and React. Statistics are read live from
          the <a href="https://data.nisra.gov.uk/">NISRA Data Portal</a>; boundaries are OSNI and
          DAERA open data. All data is available under the Open Government Licence.
        </p>
        <p>
          The official service is the{" "}
          <a href="https://explore.nisra.gov.uk/local-stats/">NISRA Local Statistics Explorer</a>.
        </p>
      </div>
    </footer>
  );
}
