// @vima appointment-be
package demo;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/app/appointment")
public class AppAppointmentController {
  @PostMapping
  public Object submit() { return null; }

  @GetMapping("/mine")
  public Object mine() { return null; }
}
