import "./WorkContextBanner.css";


export default function WorkContextBanner({ context }) {
  if (!context) {
    return null;
  }

  return (
    <section className="work-context">
      <div className="work-context-item">
        <span className="work-context-label">Site</span>
        <strong>{context.site}</strong>
      </div>

      <div className="work-context-item">
        <span className="work-context-label">Client</span>
        <strong>{context.client}</strong>
      </div>

      <div className="work-context-item">
        <span className="work-context-label">Machine</span>
        <strong>{context.machine}</strong>
      </div>

      <div className="work-context-item">
        <span className="work-context-label">
          Référence carte
        </span>

        <strong>{context.referenceCarte}</strong>
      </div>
    </section>
  );
}