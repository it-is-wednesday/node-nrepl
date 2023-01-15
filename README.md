# JS/TS nREPL
Forcefully intergrating JS into the foreign realm of Clojure tooling. Both of them can evaluate code at runtime, so why not?

This is an implementation of an [nREPL](https://nrepl.org)
[server](https://nrepl.org/nrepl/1.0/building_servers.html) wrapping
[`ts-node`](https://typestrong.org/ts-node/api/).

## Example usage with CIDER
``` emacs-lisp
(defun my/typescript-eval-defun ()
  (interactive)
  (save-mark-and-excursion
    (er/mark-js-function)
    (call-interactively #'cider-eval-region)))

(defun my/typescript-eval-symbol ()
  (interactive)
  (save-mark-and-excursion
    (er/mark-symbol)
    (call-interactively #'cider-eval-region)))

(defun my/typescript-eval-line ()
  (interactive)
  (save-mark-and-excursion
    (beginning-of-line)
    (set-mark (point))
    (end-of-line)
    (call-interactively #'cider-eval-region)))

(bind-key "C-c C-d" #'my/typescript-eval-defun typescript-mode-map)
(bind-key "C-c C-e" #'my/typescript-eval-symbol typescript-mode-map)
(bind-key "C-c C-l" #'my/typescript-eval-line typescript-mode-map)
```
