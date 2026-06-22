# Problem-solution changelog

## Parse feedback rating without generated class hashes

Problem: The feedback drawer renders its five rating stars with generated class suffixes, so matching the complete class names would break when the site rebuilds its styles.

Solution: Find the rating root and star states by their stable class prefixes. Count active stars as one and inactive stars as zero, cap parsing at five slots, and show the resulting 0-5 number in the parsed-data modal.
