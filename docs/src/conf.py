# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

import tomllib
from pathlib import Path

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = "WEISS"
copyright = "2026, WEISS Contributors"
author = "André Favoto"
pyproject = Path(__file__).parent.parent / "pyproject.toml"
release = tomllib.loads(pyproject.read_text())["project"]["version"]

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = ["myst_parser", "sphinx_copybutton"]
myst_enable_extensions = ["colon_fence", "substitution"]

templates_path = ["_templates"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]


# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = "furo"
html_title = "WEISS Documentation"
html_short_title = "WEISS"
html_static_path = ["_static"]

# Substitutions are not applied inside link URLs, so the whole badge is substituted.
# Shields static badges escape "-" as "--".
myst_substitutions = {
    "docs_badge": (
        f"[![Documentation](https://img.shields.io/badge/docs-v{release.replace('-', '--')}-blue)]"
        "(index.md)"
    ),
}
