function distTagForRef(refName) {
  const version = refName.startsWith("v") ? refName.slice(1) : refName;
  const prerelease = version.split("-", 2)[1];

  if (!prerelease) {
    return "latest";
  }

  const [firstIdentifier = "latest"] = prerelease.split(".");
  return firstIdentifier || "latest";
}

const refName = process.argv[2] ?? "";
process.stdout.write(distTagForRef(refName));
