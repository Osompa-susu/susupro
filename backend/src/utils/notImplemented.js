// Used only by Phase 5's route skeletons. Each occurrence is replaced
// by real logic in the phase named in its message — grep for this
// function name once Phase 20 runs to confirm none are left behind.
function notImplemented(phaseLabel) {
  return (req, res) => res.status(501).json({ error: `Not implemented yet — see ${phaseLabel}` });
}

module.exports = { notImplemented };
