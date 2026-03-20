import { useParams } from "react-router-dom";

function Profile() {
  const { slug, id } = useParams();

  return (
    <div>
      <h1>Provider Profile</h1>
      <p>Loading {slug} ({id})...</p>
      {/* TODO: Photo + name + credentials + contact sidebar */}
      {/* TODO: Bio */}
      {/* TODO: Services, specialties, populations served */}
      {/* TODO: Practice location(s) */}
      {/* TODO: "Report an issue" link — small, gray, bottom of page */}
    </div>
  );
}

export default Profile;
