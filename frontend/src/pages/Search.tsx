import { useParams } from "react-router-dom";

function Search() {
  const { city } = useParams();

  return (
    <div>
      <h1>Oral Health Providers in {city}</h1>
      {/* TODO: Educational triage stub text */}
      {/* TODO: Filters — provider type, specialty, keyword search */}
      {/* TODO: 3 truncated provider bios above the fold */}
      {/* TODO: "List with us" CTA */}
    </div>
  );
}

export default Search;
