import { Fragment } from "react";

/** "MATRIX | Table name, period" line linking to the NISRA Data Portal; hidden by "Display Sources". */
export default function Source({ tables, period }) {
  if (!tables?.length) return null;
  return (
    <div className="source">
      {tables.map((t, i) => (
        <Fragment key={t.matrix}>
          {i > 0 && ", "}
          <a href={t.url} target="_blank" rel="noreferrer" title={t.label}>
            {t.matrix}
          </a>
        </Fragment>
      ))}
      <span aria-hidden="true"> | </span>
      <em>
        {tables[0].label}
        {period && `, ${period}`}
      </em>
    </div>
  );
}
