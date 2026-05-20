export default function SkeletonGrid({ layout }) {
  const isList = layout === "list" || layout === "detail";

  if (isList) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="skeleton h-20" key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 12 }).map((_, index) => (
        <div className="skeleton h-44" key={index} />
      ))}
    </div>
  );
}

